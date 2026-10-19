import type { Bundle, PriceInput } from "@reanit/core/commerce";
import { cache } from "react";

import { getApi } from "../api";
import { checkPublicResponse } from "../schools/site";
import { checkStaffResponse } from "../schools/staff";

/** A bundle as the API sends it: its price without the price's id. */
export type BundleView = Omit<Bundle, "price"> & { price: PriceInput | null };

/**
 * Lists the signed-in creator's school's bundles, newest first, drafts included.
 *
 * @returns The bundles.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listStaffBundles(): Promise<BundleView[]> {
  const { data, response } = await (await getApi()).GET("/bundles");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the list.
  return data!.bundles;
}

/**
 * Loads one of the creator's bundles, draft or published, for the bundle editor.
 *
 * @param slug The bundle's slug from the URL.
 * @returns The bundle.
 * @throws {Error} Next's not-found signal for an unknown bundle, a redirect signal, or an unexpected-response error.
 */
export async function getStaffBundle(slug: string): Promise<BundleView> {
  const { data, response } = await (await getApi()).GET("/bundles/by-slug/{slug}", { params: { path: { slug } } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the bundle.
  return data!.bundle;
}

/**
 * Loads a published bundle with its courses, for its sales page. Cached per request, so the page and
 * its metadata share one call.
 *
 * @param subdomain The school's subdomain.
 * @param slug The bundle's slug.
 * @returns The bundle.
 * @throws {Error} Next's not-found signal for an unknown school or a draft or missing bundle, or an unexpected-response error.
 */
export const getSiteBundle = cache(async (subdomain: string, slug: string): Promise<BundleView> => {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/bundles/{slug}", {
    params: { path: { subdomain, slug } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the bundle.
  return data!.bundle;
});
