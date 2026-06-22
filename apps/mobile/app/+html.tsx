import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren): React.ReactNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="IE=edge" httpEquiv="X-UA-Compatible" />
        <meta content="width=device-width, initial-scale=1, shrink-to-fit=no" name="viewport" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
              }
              body {
                overflow: hidden;
              }
              [data-search-field-shell] {
                border: 1px solid #dfe7ec !important;
                box-sizing: border-box;
              }
              [data-search-field-shell]:focus-within {
                border-color: #08bd66 !important;
              }
              [data-search-field-shell] input,
              [data-search-field-shell] textarea {
                border: none !important;
                outline: none !important;
                box-shadow: none !important;
                background: transparent !important;
              }
              [data-search-field-shell] input:focus,
              [data-search-field-shell] input:focus-visible {
                border: none !important;
                outline: none !important;
                outline-width: 0 !important;
                outline-color: transparent !important;
                box-shadow: none !important;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
