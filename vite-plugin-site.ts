import type { Plugin, ViteDevServer } from 'vite';
import { renderSiteDocument } from './src/site/template';

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
        const lang = /(?:^|\/)en(?:\/|$)/.test(context.path) || /[/\\]en[/\\]index\.html$/.test(context.filename) ? 'en' : 'zh';
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
