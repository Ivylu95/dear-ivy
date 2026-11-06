'use client';

import { useId } from 'react';
import { RailCard } from '@/components/shell/RailFold';
import { Tag, Tags } from '@/components/ui';

// The tags in use, as a block of the right rail (DES-001 design 3). Beside the
// timeline this was a bare heading over a row of tags, written by hand: no
// fold, no hairline, and a heading that scrolled away while every other
// block's pinned. It is drawn now as RailNav and RailFacts are, out of
// RailCard, so it folds and stacks like them. Its own key, `tags`: folding the
// contents list says nothing about this one.
export function RailTags({ title, tags }) {
  const id = useId();
  if (!tags?.length) return null;

  return (
    <RailCard name="tags" title={title} bodyId={id}>
      <Tags id={id} className="rail-tags">
        {tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </Tags>
    </RailCard>
  );
}
