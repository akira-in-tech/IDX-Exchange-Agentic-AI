import {
  getSoldComps as getSoldCompsRuntime,
  searchActiveListings as searchActiveListingsRuntime,
} from "../../skills/mls-database-search/scripts/mls-query.mjs";
import type { PropertyFilters } from "./property-query.ts";

export interface ActiveListing {
  L_ListingID: string | null;
  L_DisplayId: string | null;
  L_Address: string | null;
  L_City: string | null;
  L_Zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  status: string | null;
  PoolPrivateYN: string | null;
  ViewYN: string | null;
  DaysOnMarket: number | null;
  PhotoCount: number | null;
}

export interface SoldComp {
  ListingKey: number | null;
  UnparsedAddress: string | null;
  City: string | null;
  CloseDate: string | null;
  ClosePrice: number | null;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  LivingArea: number | null;
}

export function searchActiveListings(filters: PropertyFilters, page = 1, limit = 10): Promise<ActiveListing[]> {
  return searchActiveListingsRuntime(filters, page, limit) as Promise<ActiveListing[]>;
}

export function getSoldComps(city: string, months = 12, limit = 10): Promise<SoldComp[]> {
  return getSoldCompsRuntime(city, months, limit) as Promise<SoldComp[]>;
}
