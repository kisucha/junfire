// src/components/record/RecordForm.tsx
// 목적: 업무 기록 입력/수정/삭제 폼 — 상태에 따라 필드 동적 표시
'use client'

import { useState, useEffect, useCallback } from 'react'
import { WorkRecordDTO, RecordStatus } from '@/types'
import StatusSelector from './StatusSelector'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatInTimeZone } from 'date-fns-tz'

interface RecordFormProps {
  date: string                      // YYYY-MM-DD — 기록할 날짜
  existingRecord?: WorkRecordDTO    // 기존 기록 (없으면 신규 입력 모드)
  onSuccess: () => void             // 저장/수정/삭제 성공 후 콜백
  // 관리자 대리 입력 시 사용할 API 경로 (기본: /api/records)
  apiBasePath?: string
  // 관리자 대리 입력 시 대상 직원 ID
  targetUserId?: string
}

// 30분 단위 시간 옵션 — 00:00 ~ 23:30 (48개)
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

// 활성 현장 간소화 타입 (id, name만 필요)
interface LocationOption {
  id: string
  name: string
}

// 폼 입력값 타입 — 시간은 HH:mm 문자열, locations는 선택된 현장명 배열
interface FormValues {
  status: RecordStatus
  startTime: string       // HH:mm
  endTime: string         // HH:mm
  locations: string[]     // 선택된 현장명 배열 — 저장 시 ", " 구분 문자열로 변환
  description: string
}

// UTC ISO 문자열에서 NZT(뉴질랜드 표준시) 기준 HH:mm 추출
function extractTimeFromISO(isoStr: string | null): string {
  if (!isoStr) return ''
  return formatInTimeZone(new Date(isoStr), 'Pacific/Auckland', 'HH:mm')
}

/**
 * 업무 기록 입력/수정 폼 컴포넌트
 * - WORK 상태: 업무 장소(필수), 시작/종료 시간(필수), 업무 내용(선택) 표시
 * - 비WORK 상태: 상태 선택만 표시 (시간/장소 필드 숨김)
 * - 야간근무: 종료시간 < 시작시간이면 "야간근무 (익일 종료)" 메시지 표시
 * - 삭제: 확인 모달 후 DELETE 요청
 */
export default function RecordForm({
  date,
  existingRecord,
  onSuccess,
  apiBasePath = '/api/records',
  targetUserId,
}: RecordFormProps) {
  const { showToast } = useToast()

  // 활성 현장 목록 (체크박스 옵션)
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([])

  // 폼 상태 초기화 — 기존 기록이 있으면 기존 값으로 채움, 신규 입력 시 기본값 07:00/15:00 적용
  // location 문자열 → ", " 구분 배열로 파싱
  const [values, setValues] = useState<FormValues>({
    status: existingRecord?.status ?? 'WORK',
    // 기존 기록: ISO 문자열 → NZT HH:mm 변환 / 신규: 기본값 07:00 (실제 근무 시작 시각)
    startTime: existingRecord ? extractTimeFromISO(existingRecord.startTime) : '07:00',
    // 기존 기록: ISO 문자열 → NZT HH:mm 변환 / 신규: 기본값 15:00 (실제 근무 종료 시각)
    endTime: existingRecord ? extractTimeFromISO(existingRecord.endTime) : '15:00',
    locations: existingRecord?.location
      ? existingRecord.location.split(', ').map((s) => s.trim()).filter(Boolean)
      : [],
    description: existingRecord?.description ?? '',
  })

  // 활성 현장 목록 로드
  const loadLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/locations')
      const json = await res.json()
      if (res.ok && json.success) {
        setLocationOptions(json.data)
      }
    } catch {
      // 현장 목록 로드 실패 — 빈 목록으로 폼 표시 (치명적 오류 아님)
    }
  }, [])

  useEffect(() => { loadLocations() }, [loadLocations])

  // 필드 에러 메시지 상태
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  // 저장 진행 중 여부
  const [isSaving, setIsSaving] = useState(false)

  // 삭제 확인 모달 표시 여부
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // 삭제 진행 중 여부
  const [isDeleting, setIsDeleting] = useState(false)

  // 야간근무 여부 감지 — 종료시간 < 시작시간
  const isNightShift =
    values.status === 'WORK' &&
    values.startTime.length === 5 &&
    values.endTime.length === 5 &&
    values.endTime < values.startTime

  // 상태 변경 시 WORK가 아니면 시간/장소 에러 초기화
  useEffect(() => {
    if (values.status !== 'WORK') {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.startTime
        delete next.endTime
        delete next.locations
        return next
      })
    }
  }, [values.status])

  // 단일 필드 값 업데이트 핸들러
  function handleChange<K extends keyof FormValues>(field: K, val: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: val }))
    // 값 변경 시 해당 필드 에러 초기화
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  // 유효성 검증 — WORK 상태는 필수 필드 확인
  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormValues, string>> = {}

    if (values.status === 'WORK') {
      if (values.locations.length === 0) {
        newErrors.locations = '업무 현장을 하나 이상 선택해주세요.'
      }
      if (!values.startTime) {
        newErrors.startTime = '시작 시간을 입력해주세요.'
      }
      if (!values.endTime) {
        newErrors.endTime = '종료 시간을 입력해주세요.'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 저장 (POST 신규 / PUT 수정) 처리
  async function handleSave() {
    if (!validate()) return

    setIsSaving(true)
    try {
      // 관리자 대리 입력 여부에 따라 payload 구성
      const payload: Record<string, unknown> = {
        date,
        status: values.status,
        ...(values.status === 'WORK' && {
          startTime: values.startTime,
          endTime: values.endTime,
          location: values.locations.join(', '),
          description: values.description.trim() || undefined,
        }),
      }

      // targetUserId가 있으면 관리자 대리 입력 — override API 호출
      if (targetUserId) {
        payload.targetUserId = targetUserId
      }

      let url = apiBasePath
      let method = 'POST'

      // 기존 기록이 있으면 수정 (PUT)
      if (existingRecord) {
        url = `${apiBasePath}/${existingRecord.id}`
        method = 'PUT'
        if (targetUserId) {
          // 관리자 대리 수정: override API에 id 포함
          payload.id = existingRecord.id
          url = apiBasePath  // override API는 항상 같은 경로
          method = 'PUT'
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '저장에 실패했습니다.', 'error')
        return
      }

      showToast(existingRecord ? '수정되었습니다.' : '저장되었습니다.', 'success')
      onSuccess()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 삭제 처리
  async function handleDelete() {
    if (!existingRecord) return

    setIsDeleting(true)
    try {
      const res = await fetch(`${apiBasePath}/${existingRecord.id}`, {
        method: 'DELETE',
      })

      // 204 No Content 응답은 body가 없으므로 json() 파싱 없이 상태코드로만 판단
      if (res.status === 204) {
        showToast('삭제되었습니다.', 'success')
        setShowDeleteModal(false)
        onSuccess()
        return
      }

      const json = await res.json()

      if (!res.ok || !json.success) {
        showToast(json.error ?? '삭제에 실패했습니다.', 'error')
        return
      }

      showToast('삭제되었습니다.', 'success')
      setShowDeleteModal(false)
      onSuccess()
    } catch {
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 날짜 표시 */}
      <div className="text-sm text-gray-500">
        <span className="font-medium text-gray-700">{date}</span> 업무 기록
      </div>

      {/* 업무 상태 선택 */}
      <StatusSelector
        value={values.status}
        onChange={(s) => handleChange('status', s)}
        disabled={isSaving || isDeleting}
        hideHoliday={false}
      />

      {/* WORK 상태일 때만 추가 필드 표시 */}
      {values.status === 'WORK' && (
        <div className="space-y-4">
          {/* 업무 현장 — 체크박스 복수 선택 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">업무 현장</label>
            {locationOptions.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                등록된 현장이 없습니다. 관리자에게 현장 등록을 요청하세요.
              </p>
            ) : (
              <div className={[
                'flex flex-wrap gap-x-4 gap-y-2 rounded-md border px-3 py-2',
                errors.locations ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
              ].join(' ')}>
                {locationOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      value={opt.name}
                      checked={values.locations.includes(opt.name)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        const next = checked
                          ? [...values.locations, opt.name]
                          : values.locations.filter((n) => n !== opt.name)
                        handleChange('locations', next)
                        if (errors.locations) setErrors((p) => ({ ...p, locations: undefined }))
                      }}
                      disabled={isSaving || isDeleting}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{opt.name}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.locations && (
              <span className="text-xs text-red-500" role="alert">{errors.locations}</span>
            )}
          </div>

          {/* 시작/종료 시간 — 30분 단위 선택 */}
          <div className="grid grid-cols-2 gap-3">
            {(['startTime', 'endTime'] as const).map((field) => {
              const label = field === 'startTime' ? '시작 시간' : '종료 시간'
              const err = errors[field]
              return (
                <div key={field} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <select
                    value={values[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    disabled={isSaving || isDeleting}
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors duration-150',
                      err
                        ? 'border-red-400 focus:ring-red-400 bg-red-50'
                        : 'border-gray-300 focus:ring-blue-500 bg-white',
                      isSaving || isDeleting ? 'bg-gray-100 cursor-not-allowed text-gray-400' : '',
                    ].join(' ')}
                  >
                    <option value="">선택</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {err && (
                    <span className="text-xs text-red-500" role="alert">{err}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 야간근무 알림 */}
          {isNightShift && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              야간근무 (익일 종료) — 종료 시간이 다음날로 계산됩니다.
            </p>
          )}

          {/* 업무 내용 (선택) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              업무 내용 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={values.description}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={isSaving || isDeleting}
              placeholder="업무 내용을 간략히 입력해주세요."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className="flex gap-2 pt-2">
        {/* 저장/수정 버튼 */}
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={isDeleting}
          className="flex-1"
        >
          {existingRecord ? '수정' : '저장'}
        </Button>

        {/* 삭제 버튼 — 기존 기록이 있을 때만 표시 */}
        {existingRecord && (
          <Button
            variant="danger"
            onClick={() => setShowDeleteModal(true)}
            disabled={isSaving || isDeleting}
          >
            삭제
          </Button>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="기록 삭제"
        message="이 날짜의 업무 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
