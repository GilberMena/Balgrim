import { ProductGrid } from "../components/product-grid";
import { api } from "../lib/api";

type ProductResponse = {
  products: Array<{
    id: string;
    slug: string;
    name: string;
    description?: string;
    variants?: Array<{ id: string; price: number | string }>;
  }>;
};

export default async function HomePage() {
  let products: ProductResponse["products"] = [];

  try {
    const data = await api<ProductResponse>("/products");
    products = data.products;
  } catch (error) {
    products = [];
  }

  return (
    <main className="shell">
      <section className="hero">
        <span>BALGRIM</span>
        <h1>Tienda base en Next.js sobre la nueva arquitectura.</h1>
        <p>Esta app queda lista para migrar la tienda actual a una base profesional con React, Zustand y backend Express.</p>
      </section>
      <ProductGrid products={products} />
    </main>
  );
}
