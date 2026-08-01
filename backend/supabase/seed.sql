-- Priorbyte — seed data for local development.
--
-- Only shared reference data (the knowledge graph). No fake users, no fake
-- learning events: student data must always be real capture.

insert into public.knowledge_graph (slug, title, subject, summary, misconceptions) values
  ('limits', 'Limits', 'Calculus',
   'The value a function approaches as its input approaches some point.',
   array[
     'Treating a limit as the value the function takes at the point',
     'Assuming a limit fails to exist whenever the function is undefined there'
   ]),
  ('derivatives', 'Derivatives', 'Calculus',
   'Instantaneous rate of change, defined as the limit of a difference quotient.',
   array[
     'Applying the power rule to the exponent of an exponential function',
     'Forgetting the chain rule on composed functions',
     'Reading the derivative as slope of the function rather than of the tangent'
   ]),
  ('chain-rule', 'Chain Rule', 'Calculus',
   'Differentiating a composition of functions.',
   array[
     'Differentiating the outer function without multiplying by the inner derivative',
     'Misidentifying which function is inner and which is outer'
   ]),
  ('integrals', 'Integrals', 'Calculus',
   'Accumulation, and the inverse of differentiation.',
   array[
     'Dropping the constant of integration',
     'Treating definite and indefinite integrals as interchangeable'
   ]),

  ('big-o', 'Big-O Notation', 'Computer Science',
   'Asymptotic upper bound on the growth of an algorithm''s cost.',
   array[
     'Reading Big-O as exact running time rather than an upper bound',
     'Keeping constant factors and lower-order terms',
     'Confusing worst case with average case'
   ]),
  ('recursion', 'Recursion', 'Computer Science',
   'A function defined in terms of itself, with a base case that terminates it.',
   array[
     'Omitting or mis-stating the base case',
     'Assuming recursion is always more expensive than iteration',
     'Losing track of what the call stack holds between calls'
   ]),
  ('pointers', 'Pointers and References', 'Computer Science',
   'Values that hold the location of other values.',
   array[
     'Confusing the pointer with the thing it points at',
     'Assuming assignment copies the underlying object'
   ]),

  ('newtons-laws', 'Newton''s Laws', 'Physics',
   'The three laws relating force, mass, and motion.',
   array[
     'Believing motion requires a continuously applied force',
     'Pairing action and reaction forces on the same body'
   ]),
  ('conservation-of-energy', 'Conservation of Energy', 'Physics',
   'Energy in a closed system is constant; it changes form rather than amount.',
   array[
     'Treating energy as consumed rather than converted',
     'Ignoring energy lost to friction when checking the balance'
   ])
on conflict (slug) do nothing;

-- Prerequisite edges.
insert into public.knowledge_graph_edges (topic_id, prerequisite_id, strength)
select t.id, p.id, 1.0
from (values
  ('derivatives', 'limits'),
  ('chain-rule', 'derivatives'),
  ('integrals', 'derivatives'),
  ('recursion', 'big-o'),
  ('conservation-of-energy', 'newtons-laws')
) as e(topic_slug, prereq_slug)
join public.knowledge_graph t on t.slug = e.topic_slug
join public.knowledge_graph p on p.slug = e.prereq_slug
on conflict do nothing;
