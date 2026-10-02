import type { Plugin, ViteDevServer } from 'vite';
import { renderSiteDocument } from './src/site/template';

/** 查询参数与锚点不参与语言判定；路径段必须精确为 en。 */
export function siteLanguage(path: string, filename = ''): 'zh' | 'en' {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const diskPath = filename.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  return /(?:^|\/)en(?:\/|$)/.test(pathname) || /(?:^|\/)en\/index\.html$/.test(diskPath) ? 'en' : 'zh';
}

/** 开发时走 SSR 模块图，文案、模型与模板变化会重新生成 HTML。 */
export function sitePlugin(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: 'outsider-static-bilingual-site',
    configureServer(devServer) { server = devServer; },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        if (!html.includes('<!--site-->')) return html;
        const lang = siteLanguage(context.path, context.filename);
        const render = server ? (await server.ssrLoadModule('/src/site/template.ts')).renderSiteDocument as typeof renderSiteDocument : renderSiteDocument;
        return render(html, lang);
      },
    },
    handleHotUpdate(context) {
      if (/[/\\](?:site|i18n|model)[/\\]/.test(context.file) || context.file.endsWith('stanceModel.ts')) {
        context.server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
