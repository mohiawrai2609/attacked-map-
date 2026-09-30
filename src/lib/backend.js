// backend.js — which backend this build talks to.
//
//   supabase (default)  today: Supabase Auth + Supabase's PostgREST.
//   gcp                 Google Cloud: our API signs people in (lib/gcpAuth.js)
//                       and our own PostgREST serves /rest/v1 on the same origin.
//                       Set at build time: VITE_BACKEND=gcp (deploy/gcp/cloudbuild.yaml).
export const BACKEND = String(import.meta.env.VITE_BACKEND || "supabase").toLowerCase();
export const GCP = BACKEND === "gcp";
