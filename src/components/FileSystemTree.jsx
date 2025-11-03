// src/components/FileSystemTree.jsx
import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { InlineEdit } from "@/components/InlineEdit"; // Importa o InlineEdit

// A DroppableArea foi movida para cá
const DroppableArea = ({ id, depth = 0, children, isDisabled }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    disabled: isDisabled,
    data: { type: "folder" },
  });

  const isRoot = id === "root";
  const isRootAndEmpty = isRoot && React.Children.count(children) === 0;

  return (
    <div
      ref={setNodeRef}
      className={`
              ${isOver ? "dragging-over-folder" : ""} 
              rounded-md
          `}
      style={{
        minHeight: isRootAndEmpty ? "100px" : "auto",
        marginLeft: "0px",
      }}
    >
      {children}
    </div>
  );
};

// O FileSystemNode foi movido para cá
// Note que ele recebe MUITAS props (handlers e estados) do DashboardPage
const FileSystemNode = ({
  node,
  depth,
  openFolders,
  editingItemId,
  isRenamingId,
  isDisabled,
  renameMutationPending, // Renomeado para evitar conflito
  onToggleFolder,
  onSetEditingItemId,
  onRename,
  onContextMenu,
  onTouchStart,
  onTouchEnd,
}) => {
  const isEditing = editingItemId === node.id;
  const isRenaming = isRenamingId === node.id && renameMutationPending;
  const isOpen = openFolders.has(node.id);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing || isDisabled) return;
    onContextMenu({ x: e.clientX, y: e.clientY, item: node });
  };

  const indentation = depth * 24;

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: {
      type: node.type,
      itemData: node.data,
      name: node.name,
      depth: depth,
    },
    disabled: isEditing || isDisabled,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: node.id,
    disabled: isDisabled || node.type !== "folder",
    data: { type: "folder" },
  });

  const setCombinedRef = (element) => {
    setDraggableRef(element);
    setDroppableRef(element);
  };

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  if (node.type === "folder") {
    return (
      <div
        ref={setCombinedRef}
        style={style}
        className={`rounded-md ${
          isOver && !isOpen ? "dragging-over-folder" : ""
        }`}
      >
        <div
          {...listeners}
          {...attributes}
          className={`flex items-center list-none p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 ${
            isEditing || isDisabled ? "" : "cursor-pointer"
          }`}
          style={{ paddingLeft: `${indentation}px` }}
          onContextMenu={handleContextMenu}
          onTouchStart={(e) =>
            isEditing || isDisabled ? null : onTouchStart(e, node)
          }
          onTouchEnd={onTouchEnd}
          onClick={() =>
            isEditing || isDisabled ? null : onToggleFolder(node.id)
          }
        >
          <span
            className={`w-6 h-6 flex items-center justify-center transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <span className="ml-1 text-yellow-400">📁</span>
          {isEditing ? (
            <InlineEdit
              initialValue={node.name}
              onSave={onRename}
              onCancel={() => onSetEditingItemId(null)}
            />
          ) : isRenaming ? (
            <span className="font-semibold ml-2 truncate opacity-50 italic">
              A guardar...
            </span>
          ) : (
            <span className="font-semibold ml-2 truncate">{node.name}</span>
          )}
        </div>

        {isOpen && (
          <DroppableArea id={node.id} depth={depth + 1} isDisabled={isDisabled}>
            {node.children && node.children.length > 0 ? (
              // Chamada recursiva para o componente principal
              <FileSystemTree
                treeData={node.children}
                depth={depth + 1}
                openFolders={openFolders}
                editingItemId={editingItemId}
                isRenamingId={isRenamingId}
                isDisabled={isDisabled}
                renameMutationPending={renameMutationPending}
                onToggleFolder={onToggleFolder}
                onSetEditingItemId={onSetEditingItemId}
                onRename={onRename}
                onContextMenu={onContextMenu}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              />
            ) : (
              <div
                className="text-xs text-gray-400 p-2"
                style={{ paddingLeft: `${(depth + 1) * 24}px` }}
              >
                (Pasta vazia)
              </div>
            )}
          </DroppableArea>
        )}
      </div>
    );
  }

  // --- DECK ---
  return (
    <div
      ref={setDraggableRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${isDragging ? "opacity-50" : ""}`}
    >
      <div
        className={`flex items-center p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700/50 ${
          isRenaming ? "opacity-50" : ""
        }`}
        style={{
          paddingLeft: `${indentation}px`,
        }}
        onContextMenu={handleContextMenu}
        onTouchStart={(e) =>
          isEditing || isDisabled ? null : onTouchStart(e, node)
        }
        onTouchEnd={onTouchEnd}
      >
        <span className="w-6 h-6 mr-1 flex items-center justify-center text-blue-400 flex-shrink-0">
          🃏
        </span>

        {isEditing ? (
          <InlineEdit
            initialValue={node.name}
            onSave={onRename}
            onCancel={() => onSetEditingItemId(null)}
          />
        ) : isRenaming ? (
          <span className="truncate block w-full opacity-50 italic ml-2">
            A guardar...
          </span>
        ) : (
          <Link
            to={`/deck/${node.id}`}
            className="truncate block w-full cursor-pointer ml-2"
          >
            {node.name}
          </Link>
        )}
      </div>
    </div>
  );
};

// Componente principal exportado
export function FileSystemTree(props) {
  const { treeData, depth = 0, activeDragItem } = props;

  return (
    <DroppableArea
      id={depth === 0 ? "root" : props.parentId}
      depth={depth}
      isDisabled={props.isDisabled}
    >
      {/* Título "Meus Baralhos" só aparece na raiz */}
      {depth === 0 && (
        <div className="text-lg font-semibold mb-2 p-1 rounded-md">
          Meus Baralhos
        </div>
      )}

      {/* Renderiza os nós */}
      {treeData.map((node) => (
        <FileSystemNode
          key={node.id}
          node={node}
          depth={depth}
          {...props} // Passa todas as outras props (handlers, estados)
        />
      ))}

      {/* Mensagem de Raiz Vazia */}
      {depth === 0 && treeData.length === 0 && !activeDragItem && (
        <p className="text-gray-500 dark:text-gray-400 text-center mt-8 p-4 pointer-events-none">
          Crie seu primeiro pasta ou baralho no painel ao lado, ou arraste itens
          para cá.
        </p>
      )}
    </DroppableArea>
  );
}
