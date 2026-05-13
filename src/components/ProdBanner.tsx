export function ProdBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
        !
      </span>
      <div>
        <p className="font-medium">Producción</p>
        <p className="text-amber-800">
          Las firmas creadas son reales y quedan asociadas a tu identidad. Si solo querés probar,
          usá preprod.
        </p>
      </div>
    </div>
  );
}
