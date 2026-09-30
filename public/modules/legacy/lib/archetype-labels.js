// lib/archetype-labels.js
//
// Frontend copy of the Forge's fixed archetype roster -- kept in sync
// by hand with functions/_lib/archetype-store.js's ARCHETYPES list,
// the same way lib/training-sample.js's CATEGORY_LABELS mirrors
// functions/_lib/training-store.js's CATEGORIES. A plain page script
// can't import a Pages Function's server-side module directly, so
// this is the frontend's own copy.

export const ARCHETYPES = [
  { slug: 'estranged_sibling', label: 'The Estranged Sibling' },
  { slug: 'jilted_ex', label: 'The Jilted Ex' },
  { slug: 'social_climber', label: 'The Social Climber' },
  { slug: 'suspicious_neighbor', label: 'The Suspicious Neighbor' },
  { slug: 'private_investigator', label: 'The Private Investigator' },
  { slug: 'new_employee', label: 'The New Employee' },
]
