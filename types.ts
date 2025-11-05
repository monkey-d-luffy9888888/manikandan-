
export enum ProductStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Done = 'Done',
  Error = 'Error',
}

export interface Attribute {
  attribute: string;
  value: string;
}

export interface Product {
  id: number;
  sku: string;
  partNumber: string;
  link: string;
  status: ProductStatus;
  attributes?: Attribute[];
  error?: string;
}