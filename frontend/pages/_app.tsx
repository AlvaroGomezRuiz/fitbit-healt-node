import * as React from "react";
import type { AppProps } from "next/app";

/**
 * Stub Pages: el App Router sirve la app; esto evita fallos de manifest en build Windows/monorepo.
 */
export default function App({ Component, pageProps }: AppProps): React.ReactElement {
  return <Component {...pageProps} />;
}
