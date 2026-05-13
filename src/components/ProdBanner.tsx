export function ProdBanner() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="text-base">⚠</span>
      <span>
        <strong>Producción.</strong> Las firmas creadas son reales y quedan asociadas a tu
        identidad. Si solo querés probar, usá preprod.
      </span>
    </div>
  );
}
