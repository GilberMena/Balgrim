import { AppError } from "../../utils/app-error.js";
import { getProductBySlug, listProducts } from "./products.service.js";

export async function getProducts(req, res) {
  const products = await listProducts();
  res.json({ products });
}

export async function getProduct(req, res) {
  const product = await getProductBySlug(req.params.slug);
  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  res.json({ product });
}
