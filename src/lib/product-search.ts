export async function buscarProdutoPorEAN(ean: string) {
  try {
    const response = await fetch(
      `https://world.openbeautyfacts.org/api/v0/product/${ean}.json`
    );

    if (!response.ok) {
      return {
        encontrado: false,
        nome: null
      };
    }

    const data = await response.json();

    if (data.status !== 1) {
      return {
        encontrado: false,
        nome: null
      };
    }

    const produto = data.product || {};

    const nome =
      produto.product_name_pt ||
      produto.product_name ||
      produto.generic_name ||
      null;

    const marca = produto.brands || "";

    return {
      encontrado: true,
      nome: marca ? `${nome} - ${marca}` : nome
    };

  } catch (error) {
    console.error("Erro ao buscar produto por EAN:", error);
    return {
      encontrado: false,
      nome: null
    };
  }
}