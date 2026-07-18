import { HoldButton } from "@repo/ui/components/evil-buttons/hold-button";

export function ButtonDemo() {
  function deleteAccount(): void {
    throw new Error("Function not implemented.");
  }

  return (
    <HoldButton
      duration={1500}
      label="Hold to delete"
      successLabel="Deleted"
      onConfirm={() => deleteAccount()}
      onAbort={(progress) => console.log("aborted at", progress)}
    />
  );
}
