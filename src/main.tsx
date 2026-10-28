import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/light-theme.css';
import './styles/themes.css';
import { applyTheme, readTheme } from './hooks/useTheme';

applyTheme(readTheme());

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el contenedor de la aplicación.');
const root = createRoot(container);
root.render(<App />);
