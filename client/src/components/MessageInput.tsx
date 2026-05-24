import React, { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Send, Smile, Paperclip, X, File as FileIcon, Reply } from "lucide-react";
import { toast } from "sonner";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface ReplyContext {
  id: number;
  content: string | null;
  type: string;
  fileName: string | null;
  sender: { name: string | null } | null;
}

interface MessageInputProps {
  conversationId: number;
  onMessageSent: () => void;
  onTyping?: (isTyping: boolean) => void;
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export default function MessageInput({
  conversationId,
  onMessageSent,
  onTyping,
  replyTo,
  onCancelReply,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus textarea when entering reply mode
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setText("");
      resetHeight();
      onCancelReply?.();
      onMessageSent();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadFile = trpc.chat.uploadFile.useMutation({
    onSuccess: () => {
      setPendingFile(null);
      setText("");
      resetHeight();
      onCancelReply?.();
      onMessageSent();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleTyping = useCallback(() => {
    onTyping?.(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping?.(false), 2000);
  }, [onTyping]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    handleTyping();
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On mobile, Enter inserts newline by default. On desktop, Enter sends.
    if (e.key === "Enter" && !e.shiftKey && !isMobile()) {
      e.preventDefault();
      handleSend();
    }
  };

  const isMobile = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  };

  const handleSend = () => {
    if (uploadFile.isPending || sendMessage.isPending) return;
    if (pendingFile) {
      handleFileSend();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate({
      conversationId,
      content: trimmed,
      replyToId: replyTo?.id,
    });
  };

  const handleFileSend = async () => {
    if (!pendingFile) return;
    const { file } = pendingFile;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(",")[1];
      uploadFile.mutate({
        conversationId,
        fileName: file.name,
        fileSize: file.size,
        fileMime: file.type || "application/octet-stream",
        fileData: base64,
        replyToId: replyTo?.id,
      });
    };
    reader.onerror = () => toast.error("파일을 읽을 수 없습니다");
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("파일 크기는 20MB 이하여야 합니다");
      return;
    }
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPendingFile({ file, preview: url });
    } else {
      setPendingFile({ file });
    }
    setShowEmoji(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const addEmoji = (emoji: { native: string }) => {
    setText((prev) => prev + emoji.native);
    textareaRef.current?.focus();
  };

  const isLoading = sendMessage.isPending || uploadFile.isPending;
  const canSend = !isLoading && (text.trim().length > 0 || !!pendingFile);

  const replyPreviewText = (() => {
    if (!replyTo) return "";
    if (replyTo.type === "image") return "📷 사진";
    if (replyTo.type === "file") return `📎 ${replyTo.fileName ?? "파일"}`;
    return replyTo.content ?? "";
  })();

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20"
          style={{
            background: "color-mix(in oklab, var(--mint) 80%, transparent)",
            border: "3px dashed var(--border)",
            borderRadius: "1rem",
          }}
        >
          <p className="font-bold text-base">파일을 여기에 놓으세요</p>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div
          className="absolute bottom-full mb-2 right-0 z-30 animate-slide-up"
          style={{ filter: "drop-shadow(4px 4px 0 var(--border))" }}
        >
          <Picker
            data={data}
            onEmojiSelect={addEmoji}
            theme="auto"
            locale="ko"
            previewPosition="none"
          />
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div
          className="flex items-center gap-2 px-3 py-2 mb-1.5 animate-slide-up"
          style={{
            background: "var(--bg-elevated)",
            border: "1.5px solid var(--border-soft)",
            borderRadius: "0.875rem",
            borderLeftWidth: 4,
            borderLeftColor: "var(--coral)",
          }}
        >
          <Reply size={14} style={{ color: "var(--coral)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold" style={{ color: "var(--coral)" }}>
              {replyTo.sender?.name ?? "이름 없음"}님에게 답장
            </p>
            <p className="text-xs truncate" style={{ color: "var(--fg-soft)" }}>
              {replyPreviewText}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="icon-btn flex-shrink-0"
            style={{ width: 28, height: 28 }}
            aria-label="답장 취소"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* File Preview */}
      {pendingFile && (
        <div
          className="flex items-center gap-3 px-3 py-2.5 mb-1.5 animate-slide-up"
          style={{
            background: "var(--bg-elevated)",
            border: "1.5px solid var(--border)",
            borderRadius: "0.875rem",
          }}
        >
          {pendingFile.preview ? (
            <img
              src={pendingFile.preview}
              alt="미리보기"
              style={{
                width: 44,
                height: 44,
                objectFit: "cover",
                borderRadius: "0.5rem",
                border: "1.5px solid var(--border)",
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                background: "var(--yellow)",
                borderRadius: "0.5rem",
                border: "1.5px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink)",
              }}
            >
              <FileIcon size={18} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{pendingFile.file.name}</p>
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              {(pendingFile.file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={() => setPendingFile(null)}
            className="icon-btn flex-shrink-0"
            style={{ width: 28, height: 28 }}
            aria-label="첨부 취소"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div
        className="flex items-end gap-2 px-2 py-2"
        style={{
          background: "var(--bg-elevated)",
          border: "1.5px solid var(--border)",
          borderRadius: "1.25rem",
        }}
      >
        {/* File attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="icon-btn flex-shrink-0"
          style={{ width: 38, height: 38 }}
          title="파일 첨부"
          aria-label="파일 첨부"
          type="button"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingFile
              ? "메시지 추가 (선택사항)"
              : replyTo
              ? "답장 입력..."
              : "메시지 입력"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
          style={{
            color: "var(--fg)",
            minHeight: 34,
            maxHeight: 120,
            padding: "0.5rem 0.25rem",
            fontSize: "0.95rem",
          }}
        />

        {/* Emoji */}
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="icon-btn flex-shrink-0"
          style={{
            width: 38,
            height: 38,
            background: showEmoji ? "var(--yellow)" : "transparent",
          }}
          title="이모지"
          aria-label="이모지"
          type="button"
        >
          <Smile size={18} />
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            width: 38,
            height: 38,
            borderRadius: "12px",
            background: canSend ? "var(--ink)" : "var(--gray-200)",
            border: "1.5px solid var(--border)",
            cursor: canSend ? "pointer" : "not-allowed",
            color: canSend ? "var(--white)" : "var(--fg-muted)",
          }}
          title="전송"
          aria-label="전송"
          type="button"
        >
          {isLoading ? (
            <div
              style={{
                width: 14,
                height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTop: "2px solid currentColor",
                borderRadius: "50%",
                animation: "spin-slow 0.8s linear infinite",
              }}
            />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
