import './styles/base.css';
import { mountLab } from './sections/lab/lab';
import { initTheme } from './ui/theme';

initTheme();

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'zh';
document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
mountLab(document.getElementById('lab-root')!, lang, { force2d: params.has('force2d') });
