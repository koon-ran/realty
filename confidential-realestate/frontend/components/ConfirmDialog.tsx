'use client';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div className="bg-[#242526] border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
        <p className="text-white mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-[#F9C80E] text-black rounded hover:bg-[#e0b50d] transition-colors font-medium"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
