"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@repo/ui/icons";

import type { NavItemFormData } from "./item-properties-drawer";

const INDENT_WIDTH = 28;
const MAX_DEPTH = 3;

export interface FlatTreeItem {
  id: string;
  parentId: string | null;
  depth: number;
  title: string;
  type: string;
  badge: string | null | undefined;
  is_featured: boolean;
  show_view_all: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  sortOrder: number;
}

function flattenTree(
  items: NavItemFormData[],
  parentId: string | null = null,
  depth: number = 0,
  collapsed: Set<string> = new Set(),
  sortStart: number = 0,
): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];
  items.forEach((item, i) => {
    const children = (item as any).children ?? [];
    const hasCh = children.length > 0;
    result.push({
      id: item.id ?? crypto.randomUUID(),
      parentId,
      depth,
      title: item.title,
      type: item.type,
      badge: item.badge,
      is_featured: item.is_featured,
      show_view_all: item.show_view_all,
      hasChildren: hasCh,
      collapsed: collapsed.has(item.id ?? ""),
      sortOrder: sortStart + i,
    });
    if (hasCh && !collapsed.has(item.id ?? "")) {
      result.push(...flattenTree(children, item.id, depth + 1, collapsed));
    }
  });
  return result;
}

function rebuildTree(flat: FlatTreeItem[]): NavItemFormData[] {
  const byParent = new Map<string | null, FlatTreeItem[]>();
  for (const f of flat) {
    const arr = byParent.get(f.parentId) ?? [];
    arr.push(f);
    byParent.set(f.parentId, arr);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const build = (parentId: string | null): NavItemFormData[] => {
    return (byParent.get(parentId) ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      type: f.type,
      badge: f.badge ?? undefined,
      is_featured: f.is_featured,
      show_view_all: f.show_view_all,
      open_in_new_tab: false,
      is_title_link: false,
      children: build(f.id) as unknown as NavItemFormData[],
    }));
  };
  return build(null);
}

function countDescendants(flat: FlatTreeItem[], parentId: string): number {
  let count = 0;
  for (const f of flat) {
    if (f.parentId === parentId) {
      count += 1 + countDescendants(flat, f.id);
    }
  }
  return count;
}

interface SortableTreeItemProps {
  item: FlatTreeItem;
  isDragging: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleCollapse: (id: string) => void;
}

function SortableTreeItem({
  item,
  isDragging,
  onEdit,
  onDelete,
  onAddChild,
  onToggleCollapse,
}: SortableTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortDragging ? 0.4 : 1,
    marginLeft: `${item.depth * INDENT_WIDTH}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 group ${isDragging ? "z-50" : ""}`}
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>

      {item.hasChildren && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-5"
          onClick={() => onToggleCollapse(item.id)}
        >
          {item.collapsed ? (
            <ChevronRightIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
        </Button>
      )}
      {!item.hasChildren && <div className="w-5" />}

      <span className="flex-1 truncate font-medium">{item.title}</span>

      <Badge variant="outline" className="text-[10px] uppercase">
        {item.type}
      </Badge>
      {item.badge && <Badge className="text-[10px]">{item.badge}</Badge>}
      {item.is_featured && (
        <Badge variant="secondary" className="text-[10px]">
          Featured
        </Badge>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onAddChild(item.id)}
          title="Add child"
        >
          <PlusIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onEdit(item.id)}
          title="Edit"
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDelete(item.id)}
          title="Delete"
        >
          <TrashIcon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function DragOverlayItem({ item }: { item: FlatTreeItem }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-popover px-3 py-2 text-sm shadow-lg"
      style={{ marginLeft: `${item.depth * INDENT_WIDTH}px`, width: "400px" }}
    >
      <GripVerticalIcon className="h-4 w-4 text-muted-foreground/40" />
      {item.hasChildren && <div className="w-5" />}
      <span className="flex-1 truncate font-medium">{item.title}</span>
      <Badge variant="outline" className="text-[10px] uppercase">
        {item.type}
      </Badge>
    </div>
  );
}

interface TreeBuilderProps {
  items: NavItemFormData[];
  onItemsChange: (items: NavItemFormData[]) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string | null) => void;
}

export function TreeBuilder({
  items,
  onItemsChange,
  onEdit,
  onDelete,
  onAddChild,
}: TreeBuilderProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [projectedDepth, setProjectedDepth] = useState<number | null>(null);
  const lastOverId = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const flat = useMemo(
    () => flattenTree(items, null, 0, collapsed),
    [items, collapsed],
  );

  const flatMap = useMemo(() => {
    const m = new Map<string, FlatTreeItem>();
    for (const f of flat) m.set(f.id, f);
    return m;
  }, [flat]);

  const flatIds = useMemo(() => flat.map((f) => f.id), [flat]);

  const activeItem = activeId ? (flatMap.get(activeId) ?? null) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const over = event.over ? String(event.over.id) : null;
      setOverId(over);
      if (over && activeId) {
        const overItem = flatMap.get(over);
        const depth = overItem ? overItem.depth : 0;
        setProjectedDepth(Math.min(depth + 1, MAX_DEPTH));
      }
    },
    [activeId, flatMap],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverId(null);
      setProjectedDepth(null);

      const { active, over, delta } = event;
      if (!over || active.id === over.id) return;

      const activeFlat = flatMap.get(String(active.id));
      if (!activeFlat) return;

      const overItem = flatMap.get(String(over.id));
      if (!overItem) return;

      const depthOffset = Math.round(delta.x / INDENT_WIDTH);
      let newDepth = overItem.depth + depthOffset;
      newDepth = Math.max(0, Math.min(MAX_DEPTH, newDepth));

      const newFlat = flat.filter((f) => f.id !== activeFlat.id);
      const overIdx = newFlat.findIndex((f) => f.id === over.id);
      if (overIdx < 0) return;

      const newParentId = newDepth === 0 ? null : overItem.id;

      newFlat.splice(overIdx + 1, 0, {
        ...activeFlat,
        parentId: newParentId,
        depth: newDepth,
      });

      newFlat.forEach((f, i) => {
        f.sortOrder = i;
        const parentItem = f.parentId
          ? newFlat.find((pf) => pf.id === f.parentId)
          : null;
        if (parentItem) {
          f.depth = Math.min(parentItem.depth + 1, MAX_DEPTH);
        } else {
          f.depth = 0;
        }
      });

      onItemsChange(rebuildTree(newFlat));
    },
    [flat, flatMap, onItemsChange],
  );

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (flat.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">No navigation items yet</p>
        <Button variant="outline" size="sm" onClick={() => onAddChild(null)}>
          Add Root Item
        </Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {flat.map((item) => (
            <div key={item.id} className="relative">
              {overId === item.id &&
                projectedDepth !== null &&
                projectedDepth <= MAX_DEPTH && (
                  <div
                    className="absolute left-0 right-0 top-0 z-10 border-t-2 border-primary pointer-events-none"
                    style={{
                      marginLeft: `${projectedDepth * INDENT_WIDTH}px`,
                      width: `calc(100% - ${projectedDepth * INDENT_WIDTH}px)`,
                    }}
                  />
                )}
              <SortableTreeItem
                item={item}
                isDragging={activeId === item.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onToggleCollapse={handleToggleCollapse}
              />
            </div>
          ))}
        </div>
      </SortableContext>

      {typeof window !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeItem && <DragOverlayItem item={activeItem} />}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}
