// Fields are optional because the published ItemDTO schema declares no required list.
export interface LightspeedAccountingGroup {
  id?: number;
  name?: string;
}

export interface LightspeedPrice {
  amount?: number;
  name?: string;
}

export type LightspeedPriceMode =
  | 'AMOUNT'
  | 'PERCENT'
  | 'POSITIVE_OPEN_PRICE'
  | 'NEGATIVE_OPEN_PRICE';

export interface LightspeedItemDto {
  id?: number;
  name?: string;
  docketName?: string;
  sku?: string;
  active?: boolean;
  barcode?: string;
  barcodes?: string[];
  accountingGroup?: LightspeedAccountingGroup;
  statisticGroups?: { category?: string; value?: string }[];
  costPrice?: number;
  prices?: LightspeedPrice[];
  sharingType?: 'GLOBAL_NO_BL' | 'GLOBAL' | 'LOCAL' | 'SHARED';
  priceMode?: LightspeedPriceMode;
  inventorySource?: 'PURCHASED' | 'PRODUCED';
  disabled?: boolean;
  contentDimension?: 'DIMENSION_LESS' | 'VOLUME' | 'MASS';
  contentUom?: string;
  contentValue?: number;
  itemType?: 'ITEM' | 'SEQUENCE' | 'GROUP' | 'SUB_ITEM';
}

// This is the published response schema, despite the endpoint's plural name.
export type LightspeedGetItemsDocumentedResponse = LightspeedItemDto;

// Local collection agreed for the prototype; not an asserted API response shape.
export type LightspeedItemFixtures = readonly LightspeedItemDto[];
