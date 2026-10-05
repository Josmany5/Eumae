export type Actor = 'you' | 'eumae';

export interface ActionStamp {
  at: string;
  by: Actor;
  action: string;
}

export interface SavedItem {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  history: ActionStamp[];
}
