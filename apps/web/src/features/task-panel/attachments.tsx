import { DownloadSimple, File, Paperclip, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MAX_ATTACHMENT_BYTES, type Outputs } from '@teamflow/contract';
import { Button, toast } from '@teamflow/ui';
import { useState } from 'react';
import { DropZone, FileTrigger } from 'react-aria-components';
import { orpc } from '../../lib/api.ts';

type Attachment = Outputs['attachments']['list'][number];

export const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function uploadFile(taskId: string, file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
  }
  const response = await fetch(
    `/api/tasks/${taskId}/attachments?name=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Upload failed (${response.status}).`);
  }
}

/** Files on a task: drop them anywhere on the list, or pick them; images get a thumbnail. */
export function Attachments({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const attachments = useQuery(orpc.attachments.list.queryOptions({ input: { taskId } }));
  const [uploading, setUploading] = useState(0);
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.attachments.list.key({ input: { taskId } }),
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.tasks.history.key({ input: { id: taskId } }),
    });
  };
  const remove = useMutation(
    orpc.attachments.delete.mutationOptions({
      onSuccess: refresh,
      onError: (error) =>
        toast({ title: 'Attachment not removed', description: error.message, tone: 'danger' }),
    }),
  );

  const upload = async (files: File[]) => {
    setUploading((n) => n + files.length);
    await Promise.all(
      files.map((file) =>
        uploadFile(taskId, file)
          .catch((error: Error) =>
            toast({ title: 'Not attached', description: error.message, tone: 'danger' }),
          )
          .finally(() => setUploading((n) => n - 1)),
      ),
    );
    refresh();
  };

  const items = attachments.data ?? [];
  const list = (
    <>
      {items.length === 0 && uploading === 0 && (
        <p className="text-ink-faint text-xs">
          {canEdit ? 'No files yet. Drop files here to attach them.' : 'No files.'}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((attachment) => (
          <AttachmentRow
            key={attachment.id}
            attachment={attachment}
            canDelete={attachment.canDelete}
            onDelete={() => remove.mutate({ id: attachment.id })}
          />
        ))}
      </ul>
      {uploading > 0 && (
        <p role="status" className="text-ink-muted text-xs">
          Uploading {uploading} {uploading === 1 ? 'file' : 'files'}…
        </p>
      )}
    </>
  );

  if (!canEdit) return <div className="flex flex-col gap-2">{list}</div>;
  return (
    <DropZone
      aria-label="Drop files to attach"
      onDrop={async (event) => {
        const files = await Promise.all(
          event.items
            .filter((item) => item.kind === 'file')
            .map((item) => (item.kind === 'file' ? item.getFile() : Promise.reject())),
        );
        void upload(files);
      }}
      className="-m-2 flex flex-col gap-2 rounded-card border border-transparent border-dashed p-2 outline-none data-[drop-target]:border-marigold data-[drop-target]:bg-raised data-[focus-visible]:outline-2 data-[focus-visible]:outline-marigold"
    >
      {list}
      <FileTrigger allowsMultiple onSelect={(files) => files && void upload([...files])}>
        <Button variant="quiet" size="sm" className="self-start">
          <Paperclip /> Attach files
        </Button>
      </FileTrigger>
    </DropZone>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
  onDelete,
}: {
  attachment: Attachment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isImage = attachment.contentType.startsWith('image/');
  return (
    <li className="group flex items-center gap-2.5 rounded-control px-1.5 py-1 hover:bg-raised">
      {isImage ? (
        <img
          src={attachment.url}
          alt=""
          className="size-9 shrink-0 rounded-[4px] border border-line object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[4px] border border-line text-ink-faint">
          <File />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-marigold"
        >
          {attachment.fileName}
        </a>
        <p className="truncate text-ink-faint text-xs">
          {formatBytes(attachment.sizeBytes)}
          {attachment.uploaderName && ` · ${attachment.uploaderName}`}
        </p>
      </div>
      <a
        href={attachment.url}
        download={attachment.fileName}
        aria-label={`Download ${attachment.fileName}`}
        className="rounded-control p-1 text-ink-muted opacity-0 outline-none hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-marigold group-hover:opacity-100"
      >
        <DownloadSimple />
      </a>
      {canDelete && (
        <Button
          variant="quiet"
          size="sm"
          aria-label={`Remove ${attachment.fileName}`}
          className="size-6 px-0 opacity-0 group-hover:opacity-100 data-[focus-visible]:opacity-100"
          onPress={onDelete}
        >
          <Trash />
        </Button>
      )}
    </li>
  );
}
