import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { AppProvider } from './context/AppContext';
import { router } from './routes';
import faviconUrl from '../imports/FUQAH-AI-icon-01@2x-1.png';

function useFavicon(href: string) {
  useEffect(() => {
    const ensureLink = (rel: string, sizes?: string) => {
      const selector = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]`;
      let link = document.querySelector<HTMLLinkElement>(selector);
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        if (sizes) link.sizes = sizes;
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = href;
    };
    ensureLink('icon');
    ensureLink('icon', '32x32');
    ensureLink('icon', '16x16');
    ensureLink('apple-touch-icon');
    ensureLink('shortcut icon');
    document.title = 'Fuqah AI';
  }, [href]);
}

export default function App() {
  useFavicon(faviconUrl);
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
