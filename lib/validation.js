const URL_FIELDS = ['live_url', 'github_url', 'image_url'];

export const PROJECT_FIELDS = [
  'title', 'slug', 'description', 'technologies', 'image_url',
  'live_url', 'github_url', 'category', 'featured', 'published', 'sort_order'
];

const text = (value, name, max, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`${name} is required`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${name} is invalid`);
  return value.trim();
};

const optionalUrl = (value, name) => {
  const clean = text(value, name, 500);
  if (!clean) return null;
  let parsed;
  try { parsed = new URL(clean); } catch { throw new Error(`${name} must be a valid URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${name} must use http or https`);
  return parsed.toString();
};

export function validateProject(input = {}, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('project must be an object');
  const output = {};
  if (!partial || 'title' in input) output.title = text(input.title, 'title', 120, true);
  if (!partial || 'slug' in input) {
    output.slug = text(input.slug, 'slug', 120, true);
    if (output.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(output.slug)) throw new Error('slug must use lowercase letters, numbers, and hyphens');
  }
  if (!partial || 'description' in input) output.description = text(input.description, 'description', 2000, true);
  if (!partial || 'technologies' in input) {
    if (!Array.isArray(input.technologies) || input.technologies.length > 20 || input.technologies.some((item) => typeof item !== 'string' || item.trim().length > 40)) throw new Error('technologies must be a list of short strings');
    output.technologies = input.technologies.map((item) => item.trim()).filter(Boolean);
  }
  for (const field of URL_FIELDS) if (!partial || field in input) output[field] = optionalUrl(input[field], field);
  for (const field of ['category']) if (!partial || field in input) output[field] = text(input[field], field, 60);
  if (!partial || 'featured' in input) output.featured = Boolean(input.featured);
  if (!partial || 'published' in input) output.published = Boolean(input.published);
  if (!partial || 'sort_order' in input) {
    const order = input.sort_order ?? 0;
    if (!Number.isInteger(order) || order < 0 || order > 100000) throw new Error('sort_order must be a non-negative integer');
    output.sort_order = order;
  }
  return output;
}

export function validateMessage(input = {}) {
  const name = text(input.name, 'name', 100, true);
  const email = text(input.email, 'email', 254, true).toLowerCase();
  const subject = text(input.subject, 'subject', 160);
  const message = text(input.message, 'message', 5000, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email is invalid');
  return { name, email, subject, message };
}

export function publicProject(project) {
  if (!project) return null;
  const { id, title, slug, description, technologies, image_url, live_url, github_url, category, featured, sort_order, created_at, updated_at } = project;
  return { id, title, slug, description, technologies, image_url, live_url, github_url, category, featured, sort_order, created_at, updated_at };
}
