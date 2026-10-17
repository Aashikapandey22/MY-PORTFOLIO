import test from 'node:test';
import assert from 'node:assert/strict';
import { publicProject, validateMessage, validateProject } from '../lib/validation.js';

test('validates and normalizes a project', () => {
  const project = validateProject({ title: 'A project', slug: 'a-project', description: 'A real project.', technologies: [' HTML ', 'CSS'], live_url: 'https://example.com', published: true });
  assert.deepEqual(project.technologies, ['HTML', 'CSS']);
  assert.equal(project.live_url, 'https://example.com/');
  assert.equal(project.published, true);
});

test('rejects unsafe project URLs and invalid slugs', () => {
  assert.throws(() => validateProject({ title: 'A', slug: 'Not Valid', description: 'x', technologies: [], github_url: 'javascript:alert(1)' }));
});

test('validates contact messages and normalizes email', () => {
  assert.deepEqual(validateMessage({ name: 'Aashika', email: 'AASHIKA@example.com', message: 'hello' }), { name: 'Aashika', email: 'aashika@example.com', subject: null, message: 'hello' });
  assert.throws(() => validateMessage({ name: 'A', email: 'not-an-email', message: 'hello' }));
});

test('public project output omits internal fields', () => {
  const output = publicProject({ id: '1', title: 'x', slug: 'x', description: 'y', technologies: [], secret: 'never return' });
  assert.equal(output.secret, undefined);
  assert.equal(output.title, 'x');
});
