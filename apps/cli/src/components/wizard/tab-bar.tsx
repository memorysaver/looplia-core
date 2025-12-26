/**
 * Tab Bar component
 *
 * Shows section tabs with progress indicators.
 * Navigate with ←/→ keys.
 */

import { Box, Text, useInput } from "ink";

export type TabSection = {
  id: string;
  title: string;
  completed: boolean;
};

type Props = {
  /** Available sections */
  sections: TabSection[];
  /** Currently active section index */
  currentIndex: number;
  /** Called when user navigates to a different tab */
  onNavigate: (index: number) => void;
  /** Whether navigation is active */
  isActive?: boolean;
  /** Disable keyboard navigation (when parent handles it) */
  disableKeyboardNav?: boolean;
};

function getStatusIcon(completed: boolean, isCurrent: boolean): string {
  if (completed) {
    return "✓";
  }
  if (isCurrent) {
    return "●";
  }
  return "";
}

function getTabColor(isCurrent: boolean, completed: boolean): string {
  if (isCurrent) {
    return "cyan";
  }
  if (completed) {
    return "green";
  }
  return "gray";
}

export function TabBar({
  sections,
  currentIndex,
  onNavigate,
  isActive = true,
  disableKeyboardNav = false,
}: Props) {
  const keyboardActive = isActive && !disableKeyboardNav;

  useInput(
    (_input, key) => {
      if (!keyboardActive) {
        return;
      }

      if (key.leftArrow && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (key.rightArrow && currentIndex < sections.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (key.tab) {
        // Tab jumps to next section
        const nextIndex = (currentIndex + 1) % sections.length;
        onNavigate(nextIndex);
      }
    },
    { isActive: keyboardActive }
  );

  return (
    <Box>
      {sections.map((section, i) => {
        const isCurrent = i === currentIndex;
        const statusIcon = getStatusIcon(section.completed, isCurrent);
        const color = getTabColor(isCurrent, section.completed);

        return (
          <Box key={section.id} marginRight={2}>
            <Text bold={isCurrent} color={color} wrap="truncate">
              {`[${section.title}${statusIcon ? ` ${statusIcon}` : ""}]`}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
