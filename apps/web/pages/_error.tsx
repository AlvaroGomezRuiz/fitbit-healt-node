import type { NextPageContext } from "next";
import * as React from "react";

interface PagesErrorProps {
  readonly statusCode?: number;
}

/**
 * Error Pages mínimo (coexiste con `app/`); evita lecturas fallidas en el primer pase de webpack en Windows.
 */
export default function PagesError({ statusCode }: PagesErrorProps): React.ReactElement {
  return (
    <div className="hidden" aria-hidden>
      {statusCode ?? ""}
    </div>
  );
}

PagesError.getInitialProps = ({ res, err }: NextPageContext): PagesErrorProps => {
  const code = res?.statusCode ?? err?.statusCode;
  return { statusCode: code };
};
