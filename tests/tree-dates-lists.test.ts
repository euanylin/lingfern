import { expect, it } from 'vitest';
import { drawTree, treeForms, treeText } from '../src/shared/tree';
import { calendarDateHead } from '../src/shared/tree-dates';

it.each(['September 20 1888', 'September 20, 1888', '20 September 1888'])('recognizes the temporal date %s', date => {
  const tree = drawTree(`the town was founded ${date}.`, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('founded');
  expect(tree.nodes.find(node => node.label === '20')?.role).toBe('obl:unmarked');
  expect(tree.nodes.find(node => node.label === 'September')?.role).toBe('nmod:unmarked');
  expect(tree.nodes.find(node => node.label === '1888')?.role).toBe('nmod:unmarked');
});

it.each([
  ['Jan. 2nd, 2024', '2nd', 'Jan.'],
  ['21st Sept 2024', '21st', 'Sept'],
  ['Feb. 29th 2024', '29th', 'Feb.'],
])('recognizes the explicit date format %s', (date, day, month) => {
  const tree = drawTree(`the town was founded ${date}.`, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('founded');
  expect(tree.nodes.find(node => node.label === day)?.role).toBe('obl:unmarked');
  expect(tree.nodes.find(node => node.label === month)?.role).toBe('nmod:unmarked');
  expect(treeText(drawTree(`the town was founded ${date}.`))).toContain(`[JJ ${day}]`);
});

it('recognizes an ISO date as a temporal phrase without splitting its spelling', () => {
  const tree = drawTree('the town was founded 2024-02-29.', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('founded');
  expect(tree.nodes.find(node => node.label === '2024-02-29')?.role).toBe('obl:unmarked');
});

it.each(['Jan. 11st 2024', 'Jan. 12nd 2024', 'Jan. 13rd 2024', 'Jan. 21th 2024', 'Feb. 29th 2023', '2023-02-29', '2024-13-01', '2024-04-31'])('rejects the malformed explicit date %s', input => {
  expect(calendarDateHead(input.split(' '))).toBeUndefined();
});

it('uses the current English temporal relation without calling a prepositional phrase unmarked', () => {
  expect(drawTree('we met every day', 'dependency').nodes.find(node => node.label === 'day')?.role).toBe('obl:unmarked');
  expect(drawTree('we met in 1999', 'dependency').nodes.find(node => node.label === '1999')?.role).toBe('obl');
});

it('keeps a grouped numeral intact and tags it as a number', () => {
  expect(treeText(drawTree('we counted 1,234,567 stars.'))).toContain('[CD 1,234,567]');
});

it.each(['1,234,567', '-1,234.5', '+12.5'])('keeps the sentence stop separate from the numeric token %s', value => {
  const tree = drawTree(`we counted ${value}.`, 'dependency');
  expect(tree.nodes.map(node => node.label)).toEqual(['we', 'counted', value, '.']);
  expect(treeText(drawTree(`we counted ${value}.`))).toContain(`[CD ${value}]`);
});

it('heads an asyndetic list on its first item', () => {
  const tree = drawTree('cats, dogs, birds', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('cats');
  for (const word of ['dogs', 'birds']) expect(tree.nodes.find(node => node.label === word)?.role).toBe('conj');
  expect(tree.nodes.find(node => node.id === tree.root)?.children).toEqual(expect.arrayContaining(
    tree.nodes.filter(node => ['dogs', 'birds'].includes(node.label)).map(node => node.id),
  ));
});

it('keeps the object and conjuncts of an Oxford-comma list', () => {
  const tree = drawTree('we bought apples, pears, and oranges.', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('bought');
  expect(tree.nodes.find(node => node.label === 'apples')?.role).toBe('obj');
  for (const word of ['pears', 'oranges']) expect(tree.nodes.find(node => node.label === word)?.role).toBe('conj');
});

it('keeps a comma-delimited nominal description as an apposition', () => {
  const tree = drawTree('my brother, a doctor, left.', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('left');
  expect(tree.nodes.find(node => node.label === 'brother')?.role).toBe('nsubj');
  expect(tree.nodes.find(node => node.label === 'doctor')?.role).toBe('appos');
});

it.each(['February 29 2000', '29 February 2024', 'September 1888', 'March 31'])('accepts the calendar pattern %s', input => {
  expect(calendarDateHead(input.split(' '))).toBeDefined();
});

it.each(['February 29 1900', 'April 31 2024', 'March 0 2024', 'September 1888 20', 'September , 20', 'September , , 20', 'cats 20 1888'])('does not force the invalid calendar pattern %s', input => {
  expect(calendarDateHead(input.split(' '))).toBeUndefined();
});

it('keeps a calendar subject distinct from a temporal adjunct', () => {
  const tree = drawTree('September 20 was cold', 'dependency');
  expect(tree.nodes.find(node => node.label === '20')?.role).toBe('nsubj');
});

it('heads a prepositional calendar phrase on the date instead of its preposition', () => {
  const tree = drawTree('we met on September 20, 1888', 'dependency');
  expect(tree.nodes.find(node => node.label === '20')?.role).toBe('obl');
  expect(tree.nodes.find(node => node.label === 'on')?.role).toBe('case');
});

it('preserves date and list words in all nine presentations', () => {
  for (const form of treeForms) for (const [sentence, expected] of [
    ['the town was founded September 20, 1888.', ['September', '20', '1888']],
    ['the town was founded Jan. 2nd, 2024.', ['Jan.', '2nd', '2024']],
    ['the town was founded 2024-02-29.', ['2024-02-29']],
    ['we bought apples, pears, and oranges.', ['apples', 'pears', 'oranges']],
  ] as const) {
    const tree = drawTree(sentence, form);
    const words = tree.nodes.filter(node => tree.kind === 'dependency' || !node.children.length).map(node => node.label.split('|')[0]);
    for (const word of expected) expect(words, form).toContain(word);
  }
});
