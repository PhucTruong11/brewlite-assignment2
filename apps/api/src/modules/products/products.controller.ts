import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query('category') category?: string) {
    if (category) {
      const products = await this.productsService.findByCategory(category);
      return { data: products };
    }
    const products = await this.productsService.findAll();
    return { data: products };
  }

  @Get('toppings')
  async findAllToppings() {
    const toppings = await this.productsService.findAllToppings();
    return { data: toppings };
  }

  @Get('best-sellers')
  async findBestsellers(@Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    const safeLimit = Number.isNaN(parsed) ? 4 : Math.min(Math.max(parsed, 1), 12);

    const products = await this.productsService.getBestSellers(safeLimit);
    return { data: products };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return { data: product };
  }
}
