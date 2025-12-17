export default function scrollToBottom(container: HTMLElement) {
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  })
}
