import { useQuery } from '@tanstack/react-query';
import { type KeyboardEvent, useState } from 'react';
import { tagsQuery, useCreateTag } from './queries';

/** 붙인 태그를 보여 주고, 이름으로 붙이거나(없으면 만들어서) 뗀다. */
export function TagPicker({
  value,
  onChange,
  label,
}: {
  value: string[];
  onChange: (tagIds: string[]) => void;
  label: string;
}) {
  const tags = useQuery(tagsQuery);
  const createTag = useCreateTag();
  const [name, setName] = useState('');
  const byId = new Map((tags.data ?? []).map((tag) => [tag.id, tag]));

  async function add() {
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    const existing = (tags.data ?? []).find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const tag = existing ?? (await createTag.mutateAsync(trimmed));
    if (!value.includes(tag.id)) {
      onChange([...value, tag.id]);
    }
    setName('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중의 Enter는 조합을 끝내는 키다
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void add();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value
        .filter((id) => byId.has(id))
        .map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(value.filter((other) => other !== id))}
            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
            title="태그 떼기"
          >
            #{byId.get(id)!.name} ×
          </button>
        ))}
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="+ 태그"
        aria-label={label}
        className="w-20 bg-transparent px-1 text-xs outline-none placeholder:text-gray-400"
      />
      {createTag.isError && (
        <span className="text-xs text-red-600">{createTag.error.message}</span>
      )}
    </div>
  );
}
