import { For, Show } from "solid-js";
import type { NoteMeta } from "~/lib/notes";
import NoteCard, { type Snippet } from "./NoteCard";

export default function NoteList(props: {
  notes: NoteMeta[];
  snippets?: Record<string, Snippet | undefined>;
  empty?: string;
}) {
  return (
    <Show when={props.notes.length > 0} fallback={<p class="hand empty-note">{props.empty ?? "아직 이런 씨앗은 심지 않았어요 🌱"}</p>}>
      <ul class="notes">
        <For each={props.notes}>{(note) => <NoteCard note={note} snippet={props.snippets?.[note.id]} />}</For>
      </ul>
    </Show>
  );
}
