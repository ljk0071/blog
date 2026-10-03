import { For } from "solid-js";
import { PROFILE } from "~/consts";

export default function Principles() {
  return (
    <ul class="principles">
      <For each={PROFILE.principles}>
        {(p) => (
          <li class="card">
            <span class="emoji" aria-hidden="true">
              {p.emoji}
            </span>
            <div>
              <b>{p.title}</b>
              <p>{p.body}</p>
            </div>
          </li>
        )}
      </For>
    </ul>
  );
}
