import type { Plugin, ViteDevServer } from 'vite';
import { renderSiteDocument } from './src/site/template';
import { renderLabHomeDocument } from './src/site/labHome';

/** 查询参数与锚点不参与语言判定；路径段必须精确为 en。 */
export function siteLanguage(path: string, filename = ''): 'zh' | 'en' {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const diskPath = filename.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  return /(?:^|\/)en(?:\/|$)/.test(pathname) || /(?:^|\/)en\/(?:index|report)\.html$/.test(diskPath) ? 'en' : 'zh';
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
        const home = html.includes('<!--lab-home-->');
        if (!home && !html.includes('<!--site-->')) return html;
        const lang = siteLanguage(context.path, context.filename);
        if (home) {
          const render = server ? (await server.ssrLoadModule('/src/site/labHome.ts')).renderLabHomeDocument as typeof renderLabHomeDocument : renderLabHomeDocument;
          return render(html, lang);
        }
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

/** 只内联构建后的同站样式，保持层叠次序与 Vite 已重写的资源路径。 */
export function inlineReportStyles(html: string, base: string, assets: ReadonlyMap<string, string>): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (tag.includes('data-inline-style-for=')) return tag;
    if (!/\brel=["']stylesheet["']/i.test(tag)) return tag;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href?.startsWith(`${base}assets/`)) return tag;
    const name = href.slice(base.length);
    const css = assets.get(name);
    if (css === undefined) throw new Error(`缺少构建样式：${name}`);
    return `<style data-report-style="${name}">${css.replace(/<\/style/gi, '<\\/style')}</style><link rel="stylesheet" href="${href}" disabled data-inline-style-for="${name}">`;
  });
}

/** 小体积报告样式随正文到达，实验室与按需三维样式仍保留缓存文件。 */
export function inlineReportStylesPlugin(): Plugin {
  let base = '/';
  return {
    name: 'outsider-inline-report-styles',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { base = config.base; },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const styles = new Map<string, string>();
        for (const asset of Object.values(bundle)) {
          if (asset.type === 'asset' && asset.fileName.endsWith('.css')) {
            styles.set(asset.fileName, typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source));
          }
        }
        for (const name of ['index.html', 'en/index.html', 'report.html', 'en/report.html']) {
          const page = bundle[name];
          if (page?.type === 'asset' && typeof page.source === 'string') page.source = inlineReportStyles(page.source, base, styles);
        }
      },
    },
  };
}
