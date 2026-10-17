import type { STATUS_VALUES } from "./validation.js";
export interface Person { username: string; name: string }
export interface Comment { author: string; body: string }
export interface Issue {
  id: string; title: string; status: typeof STATUS_VALUES[number];
  assignee: Person; body: string; comments: Comment[];
}
