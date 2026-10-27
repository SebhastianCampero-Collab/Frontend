import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import { GuardrailsPanel } from '../src/components/GuardrailsPanel';
import { config, details, log, project } from './fixtures';

const blocked = { ...details, auditId: details.audit.id, decision: 'block' as const, hookLogs: [{ ...log, reason: 'Protected file: .env' }] };
beforeEach(() => {
  vi.spyOn(api, 'hookConfig').mockResolvedValue(config);
  vi.spyOn(api, 'hookLogs').mockResolvedValue([]);
});
describe('explicit guardrail evaluation', () => {
  it('loads all examples without an evaluation or an extra resource request', async () => {
    const evaluate = vi.spyOn(api, 'evaluateHook');
    render(<GuardrailsPanel projectId={project.id} />);
    await screen.findByText('Hooks habilitados');
    const configCalls = vi.mocked(api.hookConfig).mock.calls.length;
    const logCalls = vi.mocked(api.hookLogs).mock.calls.length;
    const examples = [
      ['Archivo protegido', '.env', '+DEMO_VALUE=blocked'],
      ['Secreto ficticio', 'src/guardrail.ts', '+SECRET_KEY=demonstration'],
      ['Permitido', 'src/guardrail.ts', '+export const verified = true;'],
    ] as const;
    for (const [label, path, content] of examples) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(screen.getByLabelText('Archivos (separados por coma)')).toHaveValue(path);
      expect(screen.getByLabelText('Contenido del parche')).toHaveValue(content);
      expect(screen.getByText(/Archivo y contenido cargados/)).toBeInTheDocument();
    }
    expect(evaluate).not.toHaveBeenCalled();
    expect(api.hookConfig).toHaveBeenCalledTimes(configCalls);
    expect(api.hookLogs).toHaveBeenCalledTimes(logCalls);
  });
  it('submits edited data only on the explicit action and explains protected files', async () => {
    const evaluate = vi.spyOn(api, 'evaluateHook').mockResolvedValue(blocked);
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Permitido' }));
    fireEvent.change(screen.getByLabelText('Archivos (separados por coma)'), { target: { value: '.env' } });
    expect(evaluate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar seguridad' }));
    await screen.findByText('Bloqueado porque .env es un archivo protegido. No se modificó ningún archivo.');
    expect(evaluate).toHaveBeenCalledExactlyOnceWith(project.id, ['.env'], '+export const verified = true;');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('removes an old outcome when preparing or editing another scenario', async () => {
    const evaluate = vi.spyOn(api, 'evaluateHook').mockResolvedValue(blocked);
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo protegido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar seguridad' }));
    await screen.findByText('Bloqueado');
    fireEvent.click(screen.getByRole('button', { name: 'Secreto ficticio' }));
    expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument();
    expect(evaluate).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Contenido del parche'), { target: { value: '+const x = 1;' } });
    expect(screen.queryByText(/Archivo y contenido cargados/)).not.toBeInTheDocument();
  });
  it('uses the backend decision rather than the example name', async () => {
    vi.spyOn(api, 'evaluateHook').mockResolvedValue({ ...blocked, decision: 'allow', hookLogs: [] });
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo protegido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar seguridad' }));
    await screen.findByText('Permitido por las reglas configuradas en el backend. No se modificó ningún archivo.');
    expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument();
  });
  it('prevents changing prepared inputs or double-submitting while waiting', async () => {
    let finish!: (value: typeof blocked) => void;
    const evaluate = vi.spyOn(api, 'evaluateHook').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo protegido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar seguridad' }));
    expect(screen.getByRole('button', { name: 'Comprobando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Permitido' })).toBeDisabled();
    expect(screen.getByLabelText('Contenido del parche')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Comprobando…' }));
    expect(evaluate).toHaveBeenCalledTimes(1);
    await act(async () => finish(blocked));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Comprobar seguridad' })).toBeEnabled());
  });
  it('explains a fictitious secret from the actual blocking reason', async () => {
    vi.spyOn(api, 'evaluateHook').mockResolvedValue({ ...blocked, hookLogs: [{ ...log, reason: 'Secret pattern detected in added content.' }] });
    render(<GuardrailsPanel projectId={project.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Secreto ficticio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar seguridad' }));
    await screen.findByText('Bloqueado porque el contenido coincide con un patrón de secreto. No se modificó ningún archivo.');
  });
});
