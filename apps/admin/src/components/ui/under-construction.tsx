export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-4xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground">
        This page is under construction and will be available soon.
      </p>
    </div>
  );
}
