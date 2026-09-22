// On a soft navigation the client keeps whatever the slot was showing unless
// the server sends a real segment. This catch-all is that segment: it renders
// nothing, so an open lead modal closes when the user navigates elsewhere.
export default function ModalCatchAll() {
  return null;
}
