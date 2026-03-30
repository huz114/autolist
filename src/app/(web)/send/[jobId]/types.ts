export type Company = {
  id: string
  companyName: string | null
  url: string
  industry: string | null
  location: string | null
}

export type Profile = {
  companyName: string
  personName: string
  furigana: string
  senderEmail: string
  phone: string
  companyUrl: string
  title: string
  address: string
}

export type Message = {
  subject: string
  body: string
}

export type Props = {
  jobId: string
  keyword: string
  industry: string | null
  location: string | null
  companies: Company[]
  totalUrlCount: number
  initialProfile: Profile
  initialMessage: Message
  hasProfile: boolean
  hasMessage: boolean
}

export type ToastState = {
  message: string
  type: 'success' | 'error'
} | null

export type Template = {
  id: string
  title: string
  description: string
  subject: string
  body: string
}
