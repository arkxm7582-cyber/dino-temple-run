// Entry point: loads the fonts and styles and puts <App /> on the page.
import { createRoot } from 'react-dom/client';
import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
