import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { api } from '../src/api/client';
import { details, diagnosed, health, project, tools } from './fixtures';

function open(path: string) {
  act(() => { window.location.hash = path; window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
beforeEach(() => {
  vi.spyOn(api, 'health').mockResolvedValue(health);
  vi.spyOn(api, 'projects').mockResolvedValue([project]);
  vi.spyOn(api, 'audits').mockResolvedValue([details]);
});
describe('simple workspace navigation', () => {
  it('has exactly three primary sections and keeps technical tools out of simple mode', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: project.name });
    const nav = within(screen.getByRole('navigation', { name: 'Navegación principal' }));
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual(['Mis proyectos01', 'Revisar código02', 'Resultados e historial03']);
    expect(screen.queryByLabelText('Argumentos JSON')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bearer token')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Archivo dentro del proyecto')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/projects');
  });
  it('runs a review and opens its results without exposing raw JSON or Git hashes', async () => {
    const run = vi.spyOn(api, 'runAudit').mockResolvedValue(diagnosed);
    open('/review'); render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Archivo dentro del proyecto')).toHaveValue('src/bug.ts'));
    expect(screen.queryByRole('heading', { name: 'Historial' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Revisar código' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Revisar código' }));
    await screen.findByRole('heading', { name: 'Resultado de la revisión' });
    expect(window.location.hash).toBe('#/results');
    expect(run).toHaveBeenCalledWith({ projectId: project.id, mode: 'diagnose', path: 'src/bug.ts', checks: ['syntax', 'semantic', 'lint'] });
    expect(screen.getByText('Type string is not assignable to number')).toBeInTheDocument();
    expect(screen.queryByText('Respuesta completa recuperable desde la BD')).not.toBeInTheDocument();
    expect(screen.queryByText('Commit SHA')).not.toBeInTheDocument();
  });
  it('restores persisted results on a direct URL and exposes details only when advanced is enabled', async () => {
    open('/results'); render(<App />);
    await screen.findByText('Type string is not assignable to number');
    fireEvent.click(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detalles técnicos' }));
    expect(screen.getByText('Respuesta completa recuperable desde la BD')).toBeInTheDocument();
    expect(screen.getByText('Commit SHA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    expect(screen.queryByText('Commit SHA')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/results');
  });
  it('supports direct advanced routes and returns safely to projects when advanced is disabled', async () => {
    vi.spyOn(api, 'listTools').mockResolvedValue(tools);
    open('/advanced/mcp'); render(<App />);
    await screen.findByLabelText('Argumentos JSON');
    expect(screen.getByRole('button', { name: 'Opciones avanzadas' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Opciones avanzadas' }));
    await waitFor(() => expect(window.location.hash).toBe('#/projects'));
    expect(screen.queryByLabelText('Argumentos JSON')).not.toBeInTheDocument();
  });
  it('keeps path validation active when advanced mode is off', async () => {
    const run = vi.spyOn(api, 'runAudit');
    open('/review'); render(<App />);
    const selector = await screen.findByLabelText('Archivo dentro del proyecto');
    await waitFor(() => expect(selector).toBeEnabled());
    fireEvent.change(selector, { target: { value: '../outside.ts' } });
    expect(screen.getByRole('button', { name: 'Revisar código' })).toBeDisabled();
    expect(run).not.toHaveBeenCalled();
  });
});
