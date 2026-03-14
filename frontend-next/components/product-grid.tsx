"use client";

type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  variants?: Array<{
    id: string;
    price: number | string;
  }>;
};

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid">
      {products.map((product) => {
        const variant = product.variants?.[0];
        return (
          <article key={product.id} className="card">
            <h2>{product.name}</h2>
            <p>{product.description || "Balgrim essential piece."}</p>
            <strong>${Number(variant?.price || 0).toLocaleString("es-CO")}</strong>
            <div style={{ marginTop: 16 }}>
              <button className="button" type="button">
                Agregar al carrito
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
