import { SlideToDetonate } from "@repo/ui/components/evil-buttons/slide-to-detonate";

export function ButtonDemo() {
  function launchTheMissiles(): void {
    throw new Error("Function not implemented.");
  }

  return (
    <SlideToDetonate
      successLabel="Detonated"
      onConfirm={() => launchTheMissiles()}
    >
      Slide to detonate
    </SlideToDetonate>
  );
}
