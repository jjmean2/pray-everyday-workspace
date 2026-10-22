// openapi.yaml에서 생성한 타입이다. 직접 고치지 말고 명세를 고친 뒤 `pnpm generate`를 실행한다.
export type { components, operations, paths } from './generated/schema.js';

import type { components } from './generated/schema.js';

type Schemas = components['schemas'];

export type Health = Schemas['Health'];
export type CurrentUser = Schemas['CurrentUser'];
export type DevLoginRequest = Schemas['DevLoginRequest'];
export type Problem = Schemas['Problem'];
export type Note = Schemas['Note'];
export type NoteInput = Schemas['NoteInput'];
export type NoteList = Schemas['NoteList'];
export type PrayerItem = Schemas['PrayerItem'];
export type PrayerItemInput = Schemas['PrayerItemInput'];
export type Tag = Schemas['Tag'];
export type TagInput = Schemas['TagInput'];
export type TagList = Schemas['TagList'];
