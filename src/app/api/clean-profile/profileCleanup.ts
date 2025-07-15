type AnyObject = { [key: string]: any };

export function cleanProfile(raw: AnyObject): AnyObject {
  // Shallow copy so we don’t mutate the input
  const p = { ...raw };

  // Remove history and empty “snapshot”/“childhood” fields
  delete p.history;

  // Remove empty personal_snapshot and family_origins_childhood, or if all their fields are empty
  ['personal_snapshot', 'family_origins_childhood'].forEach(section => {
    if (!p[section]) return;
    // If all fields are empty, remove the section
    const hasValues = Object.values(p[section]).some(v =>
      typeof v === 'string' ? v.trim() !== '' : !!v
    );
    if (!hasValues) delete p[section];
  });

  // Remove empty/placeholder top-level fields (optional)
  Object.keys(p).forEach(key => {
    if (
      typeof p[key] === 'object' &&
      p[key] &&
      !Array.isArray(p[key]) &&
      Object.keys(p[key]).length === 0
    ) {
      delete p[key];
    }
  });

  // Remove known conversational artifacts (optional)
  // If you want to further filter/validate facts, you can do it here

  return p;
}
