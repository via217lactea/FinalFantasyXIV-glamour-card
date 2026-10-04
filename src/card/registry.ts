import type { Template } from './types.ts';
import { plainTemplate } from './templates/plain.tsx';
import { editorialTemplate } from './templates/editorial.tsx';
import { mastheadTemplate } from './templates/masthead.tsx';
import { spreadTemplate } from './templates/spread.tsx';

/**
 * Adding a template means adding an entry here and a component beside it.
 * Nothing else in the app needs to change — CardPreview computes the data and
 * the picker reads this list.
 */
export const TEMPLATES: Template[] = [
  plainTemplate,
  editorialTemplate,
  mastheadTemplate,
  spreadTemplate,
];

export const DEFAULT_TEMPLATE = editorialTemplate.id;

export function findTemplate(id: string): Template {
  return TEMPLATES.find((tpl) => tpl.id === id) ?? TEMPLATES[0];
}
