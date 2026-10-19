import { Provider } from '@angular/core';
import { CatalogService } from './catalog.service';
import { TcgdexCatalogService } from './tcgdex/tcgdex-catalog.service';

/** Wires the Catalog port to TCGdex. Swap the class here to change source. */
export function provideCatalog(): Provider[] {
  return [{ provide: CatalogService, useClass: TcgdexCatalogService }];
}
