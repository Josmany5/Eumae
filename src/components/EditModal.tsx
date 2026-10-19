import { useNav } from '../nav';
import { toggleEditModal, useEditModal, dataChanged } from '../focus';
import { getTask, getLists, saveTask, deleteTask } from '../tasks';
import { getEvent, saveEvent } from '../events';
import { TaskForm } from './TaskForm';
import { EventForm, removeEvent } from './QuickAdd';

/* The edit pop-up: the task or event form over whatever page you're on, so
   editing from Mae's office never moves you. Every save offers Undo. */
export default function EditModal() {
  const target = useEditModal();
  const { notify } = useNav();
  if (!target) return null;
  const close = () => toggleEditModal(null);

  if (target.k === 'task') {
    const t = getTask(target.id);
    if (!t) return null;
    return (
      <div className="emBack" onClick={close}>
        <div className="emBox" role="dialog" aria-label="Edit task" onClick={(e) => e.stopPropagation()}>
          <TaskForm
            key={t.id}
            task={t}
            lists={getLists()}
            onCancel={close}
            onDelete={() => {
              close();
              const before = t;
              deleteTask(t.id);
              dataChanged();
              notify('Task deleted.', { undo: () => { saveTask(before); dataChanged(); } });
            }}
            onSave={(next) => {
              const before = t;
              saveTask(next);
              close();
              dataChanged();
              notify('Task saved.', { undo: () => { saveTask(before); dataChanged(); } });
            }}
          />
        </div>
      </div>
    );
  }

  const ev = getEvent(target.id);
  if (!ev) return null;
  return (
    <div className="emBack" onClick={close}>
      <div className="emBox" role="dialog" aria-label="Edit event" onClick={(e) => e.stopPropagation()}>
        <EventForm
          key={ev.id}
          initial={ev}
          onCancel={close}
          onSave={(next) => {
            const before = ev;
            saveEvent(next);
            close();
            dataChanged();
            notify('Event updated.', { undo: () => { saveEvent(before); dataChanged(); } });
          }}
          onDelete={() => {
            close();
            removeEvent(notify, ev, undefined, 'all', dataChanged);
          }}
        />
      </div>
    </div>
  );
}
