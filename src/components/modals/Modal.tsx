import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "../ui/IconButton";

export function Modal({ children, close }: { children: ReactNode; close: () => void }) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <motion.section
        className="modal"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <IconButton label="Close" className="modal-close" onClick={close}>
          <X />
        </IconButton>
        {children}
      </motion.section>
    </motion.div>
  );
}
